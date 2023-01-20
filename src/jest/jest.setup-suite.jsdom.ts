// Setup test suite for jsdom.
jest.unmock('vue-i18n');
import '@testing-library/jest-dom';

import { config, RouterLinkStub } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';

import BalBreakdown from '@/components/_global/BalBreakdown/BalBreakdown.vue';
import BalBtn from '@/components/_global/BalBtn/BalBtn.vue';
import BalIcon from '@/components/_global/BalIcon/BalIcon.vue';
import BalAlert from '@/components/_global/BalAlert/BalAlert.vue';
import BalCard from '@/components/_global/BalCard/BalCard.vue';
import BalChip from '@/components/_global/BalChip/BalChip.vue';
import BalLoadingBlock from '@/components/_global/BalLoadingBlock/BalLoadingBlock.vue';
import BalTable from '@/components/_global/BalTable/BalTable.vue';
import BalTooltip from '@/components/_global/BalTooltip/BalTooltip.vue';
import BalModal from '@/components/_global/BalModal/BalModal.vue';
import CompositionIcon from '@/components/_global/icons/CompositionIcon.vue';
import NetworkIcon from '@/components/_global/icons/NetworkIcon.vue';
import StarsIcon from '@/components/_global/icons/StarsIcon.vue';
import BalCircle from '@/components/_global/shapes/BalCircle/BalCircle.vue';
import translations from '@/locales/default.json';
// import BalHorizSteps from '@/components/_global/BalHorizSteps/BalHorizSteps.vue';
import BalStack from '@/components/_global/BalStack/BalStack.vue';
import SpinnerIcon from '@/components/_global/icons/SpinnerIcon.vue';
// import BalActionSteps from '@/components/_global/BalActionSteps/BalActionSteps.vue';

const i18n = createI18n({
  locale: 'en-US',
  messages: { 'en-US': translations },
  dateTimeFormats: {
    'en-US': {
      short: {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
      },
    },
  },
});

// Testing Library config
config.global.plugins = [i18n];
config.global.stubs = {
  RouterLink: RouterLinkStub,
  Jazzicon: true,
  BalIcon: true,
  LightBulbIcon: true,
};

jest.mock('@/services/web3/useWeb3');
jest.mock('@/composables/useEthers');
jest.mock('@/composables/useTransactions');

config.global.components = {
  BalAlert,
  BalModal,
  BalCircle,
  BalBreakdown,
  BalBtn,
  BalCard,
  BalChip,
  BalIcon,
  BalLoadingBlock,
  BalTable,
  BalTooltip,
  CompositionIcon,
  NetworkIcon,
  StarsIcon,
  // BalHorizSteps,
  // BalActionSteps,
  BalStack,
  SpinnerIcon,
};
