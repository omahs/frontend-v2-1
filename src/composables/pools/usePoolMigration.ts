import { RelayerAuthorization } from '@balancer-labs/sdk';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { parseFixed } from '@ethersproject/bignumber';
import { computed, ComputedRef, Ref, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { POOL_MIGRATIONS } from '@/components/forms/pool_actions/MigrateForm/constants';
import { PoolMigrationType } from '@/components/forms/pool_actions/MigrateForm/types';
import { balancer } from '@/lib/balancer.sdk';
import { balancerContractsService } from '@/services/balancer/contracts/balancer-contracts.service';
import { configService } from '@/services/config/config.service';
import { Pool } from '@/services/pool/types';
import useWeb3 from '@/services/web3/useWeb3';
import { TransactionActionInfo } from '@/types/transactions';

import useEthers from '../useEthers';
import useTransactions from '../useTransactions';

const HALF_HOUR = 30 * 60 * 1000;
const MAX_GAS_LIMIT = 8e6;

export function usePoolMigration(
  bptBalanceScaled: string,
  unstakedAmount = '0',
  isUnstakedMigrationEnabled: boolean,
  stakedAmount = '0',
  isStakedMigrationEnabled: boolean,
  fromPool: Pool,
  relayerApproval: Ref<boolean | undefined>
) {
  /**
   * COMPOSABLES
   */
  const { txListener } = useEthers();
  const { addTransaction } = useTransactions();
  const { appNetworkConfig, account } = useWeb3();
  const { getSigner } = useWeb3();
  const vaultAddress = appNetworkConfig.addresses.vault;
  const { t } = useI18n();

  const approved = ref(false);
  const approving = ref(false);

  /**
   * STATE
   */
  const signature = ref('');

  const actions = computed(() => {
    const arr: TransactionActionInfo[] = [];

    if (isStakedMigrationEnabled) {
      arr.push({
        label: t('migratePool.previewModal.actions.staked.title'),
        loadingLabel: t('migratePool.previewModal.actions.loading'),
        confirmingLabel: t('migratePool.confirming'),
        action: approveMigration.bind(null, true, bptBalanceScaled),
        stepTooltip: t('migratePool.previewModal.actions.migrationStep'),
        isSignAction: false,
      });
    }

    if (isUnstakedMigrationEnabled) {
      const data = {
        label: t('migratePool.previewModal.actions.unstaked.title'),
        loadingLabel: t('migratePool.previewModal.actions.loading'),
        confirmingLabel: t('migratePool.confirming'),
        action: approveMigration.bind(null, false, bptBalanceScaled),
        stepTooltip: t('migratePool.previewModal.actions.migrationStep'),
        isSignAction: false,
      };

      // the biggest one is migrated first
      Number(unstakedAmount) > Number(stakedAmount)
        ? arr.unshift(data)
        : arr.push(data);
    }

    if (!relayerApproval.value) {
      arr.unshift({
        label: t('migratePool.approve'),
        loadingLabel: t('checkWallet'),
        confirmingLabel: t('migratePool.approving'),
        stepTooltip: t('approveBatchRelayerTooltip'),
        action: getUserSignature as () => Promise<any>,
        isSignAction: true,
      });
    }
    return arr;
  });

  const migrationType = computed(() => {
    return POOL_MIGRATIONS.find(
      migration => migration.fromPoolId === fromPool.id
    );
  });

  /**
   * METHODS
   */
  async function getUserSignature(): Promise<string> {
    try {
      const deadline = new Date().getTime() + HALF_HOUR;
      const vaultInstance = balancerContractsService.vault?.instance;
      const nonce = await vaultInstance.getNextNonce(account.value);
      const relayerAddress = configService.network.addresses.batchRelayer;
      const calldata = vaultInstance.interface.encodeFunctionData(
        'setRelayerApproval',
        [account.value, relayerAddress, true]
      );

      const _signature =
        await RelayerAuthorization.signSetRelayerApprovalAuthorization(
          vaultInstance,
          getSigner(),
          relayerAddress,
          calldata,
          deadline,
          nonce
        );

      const encodedSign = RelayerAuthorization.encodeCalldataAuthorization(
        '0x',
        deadline,
        _signature
      );

      signature.value = encodedSign;
      return signature.value;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async function approveMigration(
    staked = true,
    amount: string
  ): Promise<TransactionResponse> {
    const signer = getSigner();
    const signerAddress = account.value;
    const gasLimit = MAX_GAS_LIMIT;
    const _signature = relayerApproval.value ? undefined : signature.value;
    const _tokens = fromPool.tokens
      .filter(token => token.symbol !== 'bb-a-USD')
      .map(token => parseFixed(token.balance, 18).toString());

    let query;
    if (migrationType.value?.type === PoolMigrationType.BBAUSD_POOL) {
      query = balancer.zaps.migrations.bbaUsd(
        signerAddress,
        amount,
        '0',
        staked,
        _tokens,
        _signature
      );
    } else if (migrationType.value?.type === PoolMigrationType.STABAL3_POOL) {
      query = balancer.zaps.migrations.stabal3(
        signerAddress,
        amount,
        '0',
        staked,
        _signature
      );
    }

    const staticResult = await signer.call({
      to: query.to,
      data: query.data,
      gasLimit,
    });

    if (migrationType.value?.type === PoolMigrationType.BBAUSD_POOL) {
      const expectedBpts = query.decode(staticResult, staked);

      query = balancer.zaps.migrations.bbaUsd(
        signerAddress,
        amount,
        expectedBpts.bbausd2AmountOut,
        staked,
        _tokens,
        _signature
      );
    } else if (migrationType.value?.type === PoolMigrationType.STABAL3_POOL) {
      const bbausd2AmountOut = query.decode(staticResult, staked);

      query = balancer.zaps.migrations.stabal3(
        signerAddress,
        amount,
        bbausd2AmountOut,
        staked,
        _signature
      );
    }

    const tx = await signer.sendTransaction({
      to: query.to,
      data: query.data,
      gasLimit,
    });
    handleTransaction(tx);

    return tx;
  }

  async function handleTransaction(tx: TransactionResponse): Promise<void> {
    addTransaction({
      id: tx.hash,
      type: 'tx',
      action: 'approve',
      summary: t('transactionSummary.approveMigration'),
      details: {
        contractAddress: vaultAddress,
      },
    });

    approved.value = await txListener(tx, {
      onTxConfirmed: () => {
        approving.value = false;
      },
      onTxFailed: () => {
        approving.value = false;
      },
    });
  }

  return { getUserSignature, approveMigration, actions };
}
