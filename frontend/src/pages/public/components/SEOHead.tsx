import { Helmet } from 'react-helmet-async';

interface SEOHeadProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: string;
}

export default function SEOHead({
  title = 'IGD Group - Electronics Retail & Service',
  description = 'IGD Group provides quality electronics retail and professional device repair services. Track your service, browse products, and get expert assistance.',
  keywords = 'electronics, handphone repair, device service, smartphone, laptop repair, IGD Group',
  image = '/og-image.jpg',
  url = window.location.href,
  type = 'website',
}: SEOHeadProps) {
  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <link rel="canonical" href={url} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={url} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* Structured Data - LocalBusiness */}
      <script type="application/ld+json">
        {JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'LocalBusiness',
          name: 'IGD Group',
          description: description,
          url: url,
          image: image,
          address: {
            '@type': 'PostalAddress',
            addressCountry: 'ID',
            addressLocality: 'Jember',
            addressRegion: 'East Java',
          },
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: '4.8',
            reviewCount: '150',
          },
        })}
      </script>
    </Helmet>
  );
}

