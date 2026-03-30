import { FlowCanvas } from "@/components/FlowCanvas";

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          <div>
            <h1>Flow Canvas</h1>
            <p className="subtitle">
              Blocks adds nodes to the canvas; Library loads example workflows; run the graph from the top right.
            </p>
          </div>
        </div>
      </header>
      <FlowCanvas />
    </div>
  );
}
