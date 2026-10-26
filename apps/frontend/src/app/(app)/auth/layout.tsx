export const dynamic = 'force-dynamic';
import { ReactNode } from 'react';
import loadDynamic from 'next/dynamic';
import { LogoTextComponent } from '@gitroom/frontend/components/ui/logo-text.component';
import { MantineWrapper } from '@gitroom/react/helpers/mantine.wrapper';
import { Toaster } from '@gitroom/react/toaster/toaster';
const ReturnUrlComponent = loadDynamic(() => import('./return.url.component'));

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <MantineWrapper>
      <Toaster />
      <div className="socialz-auth">
        <ReturnUrlComponent />
        <section className="socialz-auth-form">
          <div className="socialz-auth-content">
            <LogoTextComponent />
            <div className="flex w-full">{children}</div>
          </div>
        </section>
        <aside className="socialz-auth-story" aria-label="About Socialz">
          <div className="socialz-orbit" aria-hidden="true">
            <img
              src="/brand/logos/socialz-symbol-primary.svg"
              width="120"
              height="120"
              alt=""
            />
          </div>
          <p className="socialz-eyebrow">YOUR CONTENT, IN RHYTHM.</p>
          <h1>
            A little more clarity.
            <br />A lot more possibility.
          </h1>
          <p>
            One calm workspace to plan your content, work together, and share
            your next chapter.
          </p>
          <div className="socialz-auth-features">
            <span>Plan ahead</span>
            <span>Create together</span>
            <span>Publish with purpose</span>
          </div>
        </aside>
      </div>
    </MantineWrapper>
  );
}
