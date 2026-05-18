import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import Image from 'next/image';
import { appName, gitConfig } from './shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      url: 'https://newapi.prorisehub.com/',
      title: (
        <span className="flex items-center gap-2 font-semibold">
          <Image
            src="/logo.png"
            alt={appName}
            width={28}
            height={28}
            priority
            className="rounded-md"
          />
          {appName}
        </span>
      ),
    },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
