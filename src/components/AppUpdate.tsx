import { useRegisterSW } from "virtual:pwa-register/react";
export function AppUpdate() {
  const {
    needRefresh: [ready],
    updateServiceWorker,
  } = useRegisterSW();
  if (!ready) return null;
  return (
    <div className="update-banner" role="status">
      নতুন সংস্করণ এসেছে। অসংরক্ষিত লেখা সংরক্ষণ করে আপডেট করুন।{" "}
      <button type="button" onClick={() => void updateServiceWorker(true)}>
        এখন আপডেট করুন
      </button>
    </div>
  );
}
