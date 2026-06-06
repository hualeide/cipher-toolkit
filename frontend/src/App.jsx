import { AppProvider, useApp } from './context/AppContext.jsx';
import NavBar from './components/NavBar.jsx';
import TransformPage from './pages/TransformPage.jsx';
import IdentifyPage from './pages/IdentifyPage.jsx';
import ChainPage from './pages/ChainPage.jsx';
import LibraryPage from './pages/LibraryPage.jsx';
import MediaPage from './pages/MediaPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import { loadSettings } from './hooks/useSettings.js';
import './index.css';

const PAGES = {
  identify: IdentifyPage,
  transform: TransformPage,
  chain: ChainPage,
  library: LibraryPage,
  media: MediaPage,
  settings: SettingsPage,
};

function AppBody() {
  const { page, loading, t } = useApp();
  const Page = PAGES[page] || IdentifyPage;

  if (loading) return <div className="app loading">{t('loading')}</div>;

  return (
    <div className="app">
      <NavBar />
      <Page />
    </div>
  );
}

export default function App() {
  const settings = loadSettings();
  if (typeof document !== 'undefined') {
    document.body.dataset.theme = settings.theme || 'dark';
  }

  return (
    <AppProvider>
      <AppBody />
    </AppProvider>
  );
}
