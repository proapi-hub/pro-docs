import { source } from '@/lib/source';
import { createFromSource } from 'fumadocs-core/search/server';
import { createTokenizer } from '@orama/tokenizers/mandarin';

// 同时支持英文与中文（Mandarin 分词），开箱即用
export const { GET } = createFromSource(source, {
  components: {
    tokenizer: createTokenizer(),
  },
  search: {
    threshold: 0,
    tolerance: 0,
  },
});

