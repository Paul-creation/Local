import type { Metadata } from 'next';
import Link from 'next/link';
import BackLink from '../components/BackLink';
import GuideSeen from '../components/guide/GuideSeen';
import GuideToc from '../components/guide/GuideToc';
import { BASE_OG } from '../lib/site';
import { getExampleVideoGameId } from '../lib/guideExample';
import {
  GUIDE_META, GUIDE_HEAD, GUIDE_SECTIONS, GUIDE_FOOT, GUIDE_SHOW_STEAM,
  GUIDE_ACTION_PREFIX, GUIDE_ACTION_SUFFIX, EXAMPLE_GAME_TOKEN,
} from '../lib/guideCopy';

// 예시 게임(영상 있는 인기 게임)을 1시간마다 새로 고른다. 문구는 모두 lib/guideCopy.ts
export const revalidate = 3600;

export const metadata: Metadata = {
  title: GUIDE_META.title,
  description: GUIDE_META.description,
  alternates: { canonical: '/guide' },
  openGraph: { ...BASE_OG, title: GUIDE_META.ogTitle, description: GUIDE_META.description, url: '/guide' },
};

export default async function GuidePage() {
  const exampleId = await getExampleVideoGameId();
  const sections = GUIDE_SECTIONS.filter((s) => !s.steam || GUIDE_SHOW_STEAM);
  const resolve = (href: string) => (href.includes(EXAMPLE_GAME_TOKEN) ? (exampleId ? href.replace(EXAMPLE_GAME_TOKEN, exampleId) : null) : href);

  return (
    <main className="page guide-page">
      <BackLink fallbackHref="/" label="홈으로" />
      <GuideSeen />
      <div className="guide-layout">
        <GuideToc items={sections.map((s) => ({ id: s.id, label: s.tocLabel }))} label={GUIDE_HEAD.tocLabel} />
        <article className="guide-body">
          <h1 className="cm-h1">{GUIDE_HEAD.title}</h1>
          <p className="cm-sub">{GUIDE_HEAD.intro}</p>
          {sections.map((s) => (
            <section key={s.id} id={s.id} className={`cm-card legal guide-section${s.big ? ' is-big' : ''}`} aria-labelledby={`${s.id}-title`}>
              <h2 id={`${s.id}-title`} className="cm-h2">{s.title}</h2>
              {s.blocks.map((b, i) => {
                const actions = b.actions.map((a) => ({ label: a.label, href: resolve(a.href) })).filter((a): a is { label: string; href: string } => !!a.href);
                return (
                  <div key={i} className="guide-block">
                    {b.heading && <h3 className="guide-h3">{b.heading}</h3>}
                    {b.paragraphs.map((p, j) => <p key={j}>{p}</p>)}
                    {actions.length > 0 && (
                      <div className="guide-actions">
                        {/* 필터 상태는 마운트 때 주소에서 한 번만 읽으므로 새로 불러오는 일반 a */}
                        {actions.map((a) => <a key={a.href} href={a.href} className="btn btn-outline">{GUIDE_ACTION_PREFIX}{a.label}{GUIDE_ACTION_SUFFIX}</a>)}
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          ))}
          <p className="cm-hint">
            {GUIDE_FOOT.text}{' '}
            {GUIDE_FOOT.links.map((l, i) => (
              <span key={l.href}>{i > 0 && ' · '}<Link href={l.href}>{l.label}</Link></span>
            ))}
          </p>
        </article>
      </div>
    </main>
  );
}
