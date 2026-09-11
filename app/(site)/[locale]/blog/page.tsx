import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getAllPosts, getFeaturedPosts } from "@/lib/sanity/fetch";
import { urlFor } from "@/lib/sanity/image";
import { buildAlternates } from "@/lib/seo";
import type { PostListItem } from "@/lib/sanity/types";
import Image from "next/image";

export const revalidate = 60; // ISR — published posts get a fresh fetch every minute

interface Props {
  params: Promise<{ locale: string }> | { locale: string };
}

// Layout's metadata template ("%s | Glatko") appends the site name —
// keep these strings clean so the rendered <title> doesn't double-suffix.
const PAGE_TITLES: Record<string, string> = {
  me: "Blog",
  tr: "Blog",
  en: "Blog",
  ru: "Блог",
  de: "Blog",
  it: "Blog",
  sr: "Blog",
  ar: "مدونة",
  uk: "Блог",
};

const PAGE_DESCRIPTIONS: Record<string, string> = {
  me: "Insightovi i vodiči o uslugama, životu i poslu u Crnoj Gori.",
  tr: "Karadağ'da hizmetler, yaşam ve iş hakkında rehberler ve makaleler.",
  en: "Guides and insights on services, lifestyle and business in Montenegro.",
  ru: "Гайды и материалы об услугах, жизни и бизнесе в Черногории.",
  de: "Ratgeber und Einblicke zu Dienstleistungen, Leben und Geschäft in Montenegro.",
  it: "Guide e approfondimenti su servizi, vita e business in Montenegro.",
  sr: "Vodiči i članci o uslugama, životu i poslu u Crnoj Gori.",
  ar: "أدلة ورؤى حول الخدمات وأسلوب الحياة والأعمال في الجبل الأسود.",
  uk: "Гайди та матеріали про послуги, життя та бізнес у Чорногорії.",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await Promise.resolve(params);
  if (!hasLocale(routing.locales, locale)) return {};

  const title = PAGE_TITLES[locale] ?? PAGE_TITLES.me;
  const description = PAGE_DESCRIPTIONS[locale] ?? PAGE_DESCRIPTIONS.me;
  const alternates = buildAlternates(locale, "/blog");

  return {
    title,
    description,
    alternates,
    openGraph: {
      title,
      description,
      url: alternates.canonical,
      siteName: "Glatko",
      locale,
      type: "website",
    },
    robots: { index: true, follow: true },
  };
}

export default async function BlogIndexPage({ params }: Props) {
  const { locale } = await Promise.resolve(params);
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  // Fetch in parallel; tolerate Sanity errors gracefully so the route
  // never 500s when the dataset is empty (just-launched state).
  // `getTranslations` is awaited for its locale-priming side effect even
  // though the labels we use on this page are inlined per-locale below.
  const [posts, featured] = await Promise.all([
    getAllPosts(locale).catch(() => [] as PostListItem[]),
    getFeaturedPosts(locale).catch(() => [] as PostListItem[]),
    getTranslations(),
  ]);

  const featuredIds = new Set(featured.map((p) => p._id));
  const remaining = posts.filter((p) => !featuredIds.has(p._id));

  const title = PAGE_TITLES[locale] ?? PAGE_TITLES.me;
  const description = PAGE_DESCRIPTIONS[locale] ?? PAGE_DESCRIPTIONS.me;
  const emptyLabel =
    locale === "tr"
      ? "Henüz makale yok — yakında geliyor."
      : locale === "en"
        ? "No articles yet — coming soon."
        : "Još nema članaka — uskoro.";

  return (
    <main className="mx-auto max-w-6xl px-4 pb-20 pt-28 sm:px-6 lg:px-8">
      <header className="mb-10">
        <h1 className="font-serif text-4xl font-semibold text-gray-900 dark:text-white md:text-5xl">
          {title}
        </h1>
        <p className="mt-3 max-w-2xl text-gray-600 dark:text-white/60">
          {description}
        </p>
      </header>

      {featured.length > 0 ? (
        <section className="mb-14">
          <h2 className="mb-5 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-white/40">
            {locale === "tr"
              ? "Öne çıkanlar"
              : locale === "en"
                ? "Featured"
                : "Istaknuto"}
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {featured.map((post) => (
              <PostCard key={post._id} post={post} locale={locale} />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-5 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-white/40">
          {locale === "tr"
            ? "Tüm makaleler"
            : locale === "en"
              ? "All articles"
              : "Svi članci"}
        </h2>
        {remaining.length === 0 && featured.length === 0 ? (
          <div className="rounded-2xl border border-gray-200/70 bg-white/70 px-6 py-16 text-center text-gray-500 backdrop-blur-sm dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white/50">
            {emptyLabel}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {remaining.map((post) => (
              <PostCard key={post._id} post={post} locale={locale} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function PostCard({ post, locale }: { post: PostListItem; locale: string }) {
  const cover = post.coverImage;
  return (
    <Link
      href={{ pathname: "/blog/[slug]", params: { slug: post.slug } }}
      className="group block overflow-hidden rounded-2xl border border-gray-200/70 bg-white/80 backdrop-blur-sm transition-all hover:border-teal-500/30 hover:shadow-lg dark:border-white/[0.08] dark:bg-white/[0.04]"
    >
      {cover?.asset ? (
        <div className="relative aspect-[16/9] overflow-hidden">
          <Image
            src={urlFor(cover).width(800).height(450).url()}
            alt={cover.alt ?? post.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        </div>
      ) : null}
      <div className="p-6">
        {post.category ? (
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-400">
            {post.category.title}
          </div>
        ) : null}
        <h3 className="font-serif text-xl font-semibold text-gray-900 transition-colors group-hover:text-teal-700 dark:text-white dark:group-hover:text-teal-300">
          {post.title}
        </h3>
        {post.excerpt ? (
          <p className="mt-2 line-clamp-3 text-sm text-gray-600 dark:text-white/60">
            {post.excerpt}
          </p>
        ) : null}
        <div className="mt-4 flex items-center gap-2 text-xs text-gray-500 dark:text-white/50">
          {post.author?.name ? <span>{post.author.name}</span> : null}
          {post.author?.name ? <span>·</span> : null}
          <time dateTime={post.publishedAt}>
            {new Date(post.publishedAt).toLocaleDateString(locale)}
          </time>
        </div>
      </div>
    </Link>
  );
}
