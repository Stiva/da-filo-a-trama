import { createServiceRoleClient } from '@/lib/supabase/server';
import Image from 'next/image';

interface Sponsor {
  id: string;
  name: string;
  url: string;
  image_url: string;
  sort_order: number;
}

async function getSponsors(): Promise<Sponsor[]> {
  try {
    const supabase = createServiceRoleClient();
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'footer_sponsors')
      .maybeSingle();

    if (data?.value?.sponsors && Array.isArray(data.value.sponsors)) {
      return (data.value.sponsors as Sponsor[]).sort((a, b) => a.sort_order - b.sort_order);
    }
  } catch (e) {
    console.error('FooterSponsors: failed to load sponsors', e);
  }
  return [];
}

/**
 * Server component: renders the sponsor logos row for the footer.
 * Falls back to an empty fragment if no sponsors are configured.
 */
export default async function FooterSponsors() {
  const sponsors = await getSponsors();

  if (sponsors.length === 0) return null;

  return (
    <div className="flex flex-col items-center md:items-start text-center md:text-left gap-4">
      <p className="text-sm text-white/80 font-medium">Evento realizzato con il patrocinio di:</p>
      <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
        {sponsors.map((sponsor) => (
          <a
            key={sponsor.id}
            href={sponsor.url}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-transform hover:scale-105 bg-white p-2 rounded-xl h-16 sm:h-20 flex items-center justify-center shadow-lg"
            title={sponsor.name}
          >
            <Image
              src={sponsor.image_url}
              alt={sponsor.name}
              width={100}
              height={100}
              className="max-h-full w-auto object-contain"
              unoptimized
            />
          </a>
        ))}
      </div>
    </div>
  );
}
