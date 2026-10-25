import { MediaLayoutComponent } from '@gitroom/frontend/components/new-layout/layout.media.component';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: `Socialz Media`,
  description: '',
};

export default async function Page() {
  return <MediaLayoutComponent />;
}
