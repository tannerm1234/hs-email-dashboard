export const metadata = { title: 'HubSpot Workflow Email Inventory' };
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{margin:'0',fontFamily:'system-ui, -apple-system, Segoe UI, Roboto',color:'#e5e7eb',background:'#0a0a0a'}}>
        <div style={{maxWidth: '1100px', margin: '0 auto', padding: '24px'}}>
          {children}
        </div>
      </body>
    </html>
  );
}
