export default function AuthenticatedLoading() {
  return (
    <div
      className="fixed inset-x-0 top-0 z-50 h-1 overflow-hidden bg-evergreen/15"
      role="status"
      aria-label="Loading page"
    >
      <span className="loading-slide block h-full w-1/3 bg-evergreen" />
    </div>
  );
}
