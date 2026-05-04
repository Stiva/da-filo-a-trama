import Image from 'next/image';

/**
 * "Progetto sostenuto da" block with the Fondazione di Modena logo.
 * Per linee guida: dicitura fissa, niente alternative, logo non modificato in colori/proporzioni,
 * spazio di rispetto attorno al logo.
 */
export default function FooterSupporter() {
  return (
    <div className="w-full flex flex-col items-center md:items-start gap-4 pt-6 border-t border-white/15">
      <p className="text-sm text-white/80 font-medium">Progetto sostenuto da</p>
      <a
        href="https://www.fondazionedimodena.it/"
        target="_blank"
        rel="noopener noreferrer"
        className="bg-white p-3 rounded-xl inline-flex items-center justify-center shadow-lg transition-transform hover:scale-105 hover:shadow-xl"
        title="Fondazione di Modena"
      >
        <Image
          src="/fondazione-modena.png"
          alt="Fondazione di Modena"
          width={320}
          height={80}
          className="h-12 sm:h-14 w-auto object-contain"
          unoptimized
          priority={false}
        />
      </a>
    </div>
  );
}
