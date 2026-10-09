import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/noto-sans-bengali/bengali-400.css";
import "@fontsource/noto-sans-bengali/bengali-500.css";
import "@fontsource/noto-sans-bengali/bengali-600.css";
import "@fontsource/noto-sans-bengali/bengali-700.css";
import "@fontsource/noto-sans-bengali/latin-400.css";
import "@fontsource/noto-sans-bengali/latin-600.css";
import App from "./App";
import "./styles.css";
class Boundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="standalone" role="alert">
        <h1>পাতাটি খুলতে সমস্যা হয়েছে</h1>
        <p>আবার লোড করুন। সমস্যা চলতে থাকলে সহায়তা নিন।</p>
        <button onClick={() => location.reload()}>আবার লোড করুন</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Boundary>
      <App />
    </Boundary>
  </React.StrictMode>,
);
