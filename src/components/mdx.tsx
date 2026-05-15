import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Banner } from 'fumadocs-ui/components/banner';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import { Step, Steps } from 'fumadocs-ui/components/steps';
import { Callout } from 'fumadocs-ui/components/callout';
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import { File, Files, Folder } from 'fumadocs-ui/components/files';
import { TypeTable } from 'fumadocs-ui/components/type-table';
import { ImageZoom } from 'fumadocs-ui/components/image-zoom';
import { InlineTOC } from 'fumadocs-ui/components/inline-toc';
import { Popup, PopupContent, PopupTrigger } from 'fumadocs-twoslash/ui';
import { Mermaid } from './mermaid';
import { PythonRunner } from './python-runner';
import { APIPage } from './api-page';
import type { MDXComponents } from 'mdx/types';

// 外部图片缺少 width/height，next/image 会抛错；用原生 <img> 兜底
function RawImg(props: React.ImgHTMLAttributes<HTMLImageElement>) {
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  return <img loading="lazy" {...props} />;
}

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    img: RawImg,
    Banner,
    Tab,
    Tabs,
    Step,
    Steps,
    Callout,
    Accordion,
    Accordions,
    File,
    Files,
    Folder,
    TypeTable,
    ImageZoom,
    InlineTOC,
    Popup,
    PopupContent,
    PopupTrigger,
    Mermaid,
    PythonRunner,
    APIPage,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
