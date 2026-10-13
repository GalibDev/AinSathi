import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Modal, Button } from "./ui";
interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [help, setHelp] = useState(false);
  const [installed, setInstalled] = useState(
    () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    const ready = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    const complete = () => {
      setInstalled(true);
      setPrompt(null);
      setHelp(false);
    };
    const change = () =>
      setInstalled(
        media.matches ||
          Boolean(
            (navigator as Navigator & { standalone?: boolean }).standalone,
          ),
      );
    window.addEventListener("beforeinstallprompt", ready);
    window.addEventListener("appinstalled", complete);
    media.addEventListener("change", change);
    return () => {
      window.removeEventListener("beforeinstallprompt", ready);
      window.removeEventListener("appinstalled", complete);
      media.removeEventListener("change", change);
    };
  }, []);
  async function install() {
    if (!prompt) {
      setHelp(true);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await prompt.prompt();
      const result = await prompt.userChoice;
      if (result.outcome === "accepted") setInstalled(true);
    } catch {
      setError("ইনস্টল উইন্ডো খোলেনি। ব্রাউজারের মেনু থেকে চেষ্টা করুন।");
      setHelp(true);
    } finally {
      setPrompt(null);
      setBusy(false);
    }
  }
  if (installed) return null;
  return (
    <>
      <button
        className="install-app button primary"
        type="button"
        onClick={() => void install()}
        disabled={busy}
      >
        <Download size={17} />
        {busy ? "অপেক্ষা করুন…" : "অ্যাপ ইনস্টল"}
      </button>
      {help && (
        <Modal title="AinSathi ইনস্টল করুন" onClose={() => setHelp(false)}>
          <p>হোম স্ক্রিনে যোগ করলে AinSathi আলাদা অ্যাপের মতো খুলবে।</p>
          <h3>iPhone / iPad</h3>
          <p>
            Safari-তে এই ওয়েবসাইট খুলুন → Share বাটন চাপুন → Add to Home Screen
            → Add।
          </p>
          <h3>Android / কম্পিউটার</h3>
          <p>
            Chrome বা Edge-এর মেনু খুলুন → Install app / Add to Home screen।
            অপশন না থাকলে মূল ব্রাউজারে লিংকটি খুলে আবার চেষ্টা করুন।
          </p>
          <p className="muted">মামলার তথ্য দেখতে ইন্টারনেট লাগবে।</p>
          {error && <p role="alert">{error}</p>}
          <Button type="button" onClick={() => setHelp(false)}>
            বুঝেছি
          </Button>
        </Modal>
      )}
    </>
  );
}
