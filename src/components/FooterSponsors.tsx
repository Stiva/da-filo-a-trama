import { createServiceRoleClient } from '@/lib/supabase/server';
import Image from 'next/image';

interface Sponsor {
  id: string;
  name: string;
  url: string;
  image_url: string;
  sort_order: number;
}
interface SponsorSection {
  id: string;
  title: string;
  sponsors: Sponsor[];
}

async function getSections(): Promise<SponsorSection[]> {
  try {
    const supabase = createServiceRoleClient();
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'footer_sponsors')
      .maybeSingle();

    if (data?.value) {
      // Nuovo formato 
      if (Array.isArray(data.value.sections)) {
        return data.value.sections as SponsorSection[];
      } 
      // Fallback per vecchio formato
      else if (Array.isArray(data.value.sponsors)) {
        return [{
          id: '1',
          title: 'Evento realizzato con il contributo di:',
          sponsors: (data.value.sponsors as Sponsor[]).sort((a, b) => a.sort_order - b.sort_order)
        }];
      }
    }
  } catch (e) {
    console.error('FooterSponsors: failed to load sponsors', e);
  }
  return [];
}

/**
 * Server component: renders the sponsor logos sections for the footer.
 * Falls back to an empty fragment if no sponsors are configured.
 */
export default async function FooterSponsors() {
  const sections = await getSections();
  const activeSections = sections.filter(s => s.sponsors && s.sponsors.length > 0);

  if (activeSections.length === 0) return null;

  return (
    <div className="flex flex-col items-center gap-8 md:items-start text-center md:text-left w-full">
      {activeSections.map(section => (
        <div key={section.id} className="flex flex-col items-center md:items-start text-center md:text-left gap-4 w-full">
          {section.title && <p className="text-sm text-white/80 font-medium">{section.title}</p>}
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
            {section.sponsors.sort((a,b) => a.sort_order - b.sort_order).map((sponsor) => (
              <a
                key={sponsor.id}
                href={sponsor.url}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-transform hover:scale-105 bg-white p-2 rounded-xl h-16 sm:h-20 flex items-center justify-center shadow-lg hover:shadow-xl"
                title={sponsor.name}
              >
                <Image
                  src={sponsor.image_url}
                  alt={sponsor.name}
                  width={200}
                  height={150}
                  className="max-h-full max-w-[120px] sm:max-w-[160px] w-auto object-contain"
                  unoptimized
                />
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
