/**
 * Root Layout Component
 * 
 * @component RootLayout
 * @description The root layout component for the Next.js application, providing the base HTML structure
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components to render within the layout
 * @returns {JSX.Element} HTML document structure with body containing children
 * 
 * @example
 * // Automatically used by Next.js for all pages
 * <RootLayout>
 *   <HomePage />
 * </RootLayout>
 * 
 * @accessibility Sets language attribute to 'en' for screen readers
 * @seo Provides semantic HTML structure for search engines
 * @version 2.0.0
 * @author MediaNest Team
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
