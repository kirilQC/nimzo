/** Re-mounted on every navigation: the page eases in and its sections rise one after another. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
