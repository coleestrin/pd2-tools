import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MantineProvider, createTheme } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Layout
import { HeaderSearch } from "./components/layout/NavBar";
import { Footer } from "./components/layout/Footer";

// Pages
import Home from "./pages/Home";
import Builds from "./pages/Builds";
import Meta from "./pages/Meta";
import Character from "./pages/Character";
import Account from "./pages/Account";
import Economy from "./pages/Economy";
import ItemDetail from "./pages/ItemDetail";
import Statistics from "./pages/Statistics";
import Leaderboard from "./pages/Leaderboard";
import CharacterExport from "./pages/CharacterExport";
import CorruptedZoneTracker from "./pages/CorruptedZoneTracker";
import About from "./pages/About";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import NotFound from "./pages/NotFound";
import { ErrorBoundary } from "./components/shared";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const customDarkTheme = createTheme({
  colorScheme: "dark",
  colors: {
    dark: [
      "#C1C2C5",
      "#A6A7AB",
      "#909296",
      "#5C5F66",
      "#373A40",
      "#2C2E33",
      "#25262B",
      "#1A1B1E",
      "#141517",
      "#101113",
    ],
  },
  primaryColor: "blue",
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

                  {/* Meta */}
                  <Route path="/meta" element={<Meta />} />

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
