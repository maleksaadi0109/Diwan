import { useState } from "react";
import { ActiveTab, Poem } from "./types";
import { MOCK_POEMS } from "./data/mockData";
import { Navigation } from "./components/Navigation";
import { Header } from "./components/Header";
import { LibraryView } from "./features/library/LibraryView";
import { PoemPlayerView } from "./features/player/PoemPlayerView";
import { ImportView } from "./features/import/ImportView";
import { SettingsView } from "./features/settings/SettingsView";

export function App() {
  const [poems, setPoems] = useState<Poem[]>(MOCK_POEMS);
  const [activeTab, setActiveTab] = useState<ActiveTab>("library");
  const [activePoem, setActivePoem] = useState<Poem | null>(MOCK_POEMS[0] || null);

  const handleOpenPoem = (poem: Poem) => {
    setActivePoem(poem);
    setActiveTab("player");
  };

  const handleImportPoem = (newPoem: Poem) => {
    setPoems((prev) => [newPoem, ...prev]);
    setActivePoem(newPoem);
    setActiveTab("player");
  };

  return (
    <div className="h-screen w-screen flex bg-charcoal-950 text-parchment-100 overflow-hidden select-none min-w-[900px] min-h-[600px]">
      {/* Right-side RTL Navigation */}
      <Navigation
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        hasActivePoem={activePoem !== null}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-charcoal-950">
        <Header
          activeTab={activeTab}
          activePoem={activePoem}
          onBackToLibrary={() => setActiveTab("library")}
        />

        <main className="flex-1 overflow-hidden relative">
          {activeTab === "library" && (
            <LibraryView
              poems={poems}
              onOpenPoem={handleOpenPoem}
              onNavigateToImport={() => setActiveTab("import")}
            />
          )}

          {activeTab === "player" && activePoem && (
            <PoemPlayerView poem={activePoem} />
          )}

          {activeTab === "import" && (
            <ImportView onImportPoem={handleImportPoem} />
          )}

          {activeTab === "settings" && <SettingsView />}
        </main>
      </div>
    </div>
  );
}

export default App;
