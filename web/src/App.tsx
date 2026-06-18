import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Layout
import { HeaderSearch } from "./components/layout/NavBar";
import { Footer } from "./components/layout/Footer";

// Pages
import Home from "./pages/Home";
import Builds from "./pages/Builds";
import Character from "./pages/Character";
import Account from "./pages/Account";
import Economy from "./pages/Economy";
import ItemDetail from "./pages/ItemDetail";
import Statistics from "./pages/Statistics";
import Leaderboard from "./pages/Leaderboard";
import CharacterExport from "./pages/CharacterExport";
import CorruptedZoneTracker from "./pages/CorruptedZoneTracker";
import DamageCalculator from "./pages/DamageCalculator";
import About from "./pages/About";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import NotFound from "./pages/NotFound";
import { ErrorBoundary } from "./components/shared";
import { customDarkTheme } from "./theme";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <MantineProvider theme={customDarkTheme} defaultColorScheme="dark">
          <BrowserRouter>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                minHeight: "100vh",
              }}
            >
              <HeaderSearch />

              <main style={{ flex: 1 }}>
                <Routes>
                  {/* Home */}
                  <Route path="/" element={<Home />} />

                  {/* Builds */}
                  <Route path="/builds" element={<Builds />} />
                  <Route
                    path="/builds/character/:name"
                    element={<Character />}
                  />
                  <Route
                    path="/builds/account/:accountName"
                    element={<Account />}
                  />

                  {/* Economy */}
                  <Route path="/economy/:category" element={<Economy />} />
                  <Route
                    path="/economy/item/:itemNameURL"
                    element={<ItemDetail />}
                  />

                  {/* Statistics */}
                  <Route path="/statistics" element={<Statistics />} />

                  {/* Leaderboard */}
                  <Route path="/leaderboard" element={<Leaderboard />} />

                  {/* Tools */}
                  <Route
                    path="/tools/character-export"
                    element={<CharacterExport />}
                  />
                  <Route
                    path="/tools/corrupted-zone-tracker"
                    element={<CorruptedZoneTracker />}
                  />
                  <Route
                    path="/tools/damage-calculator"
                    element={<DamageCalculator />}
                  />

                  {/* Info Pages */}
                  <Route path="/about" element={<About />} />
                  <Route path="/privacy-policy" element={<PrivacyPolicy />} />

                  {/* 404 */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </main>

              <Footer />
            </div>
          </BrowserRouter>
        </MantineProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
