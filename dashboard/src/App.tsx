import { BrowserRouter, useLocation } from 'react-router-dom'
import TabNav from './components/TabNav'
import WorkDirSelector from './components/WorkDirSelector'
import LanguageSwitcher from './components/LanguageSwitcher'
import RefreshControl from './components/RefreshControl'
import ErrorBoundary from './components/ErrorBoundary'
import DashboardPage from './pages/DashboardPage'
import ViewerPage from './pages/ViewerPage'
import CreatePage from './pages/CreatePage'
import TerminalPage from './pages/TerminalPage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import { useWorkDir } from './stores/useWorkDir'

function PageContainer() {
  const { workDir } = useWorkDir()
  const location = useLocation()
  const path = location.pathname

  const isDashboard = path === '/'
  const isViewer = path.startsWith('/viewer')
  const isCreate = path === '/create'
  const isTerminal = path === '/terminal'
  const isProject = path.startsWith('/project/')

  return (
    <div className="flex-1 overflow-hidden relative">
      <div className={`absolute inset-0 ${isDashboard ? '' : 'hidden'}`}>
        <DashboardPage workDir={workDir} />
      </div>
      <div className={`absolute inset-0 ${isViewer ? '' : 'hidden'}`}>
        <ViewerPage workDir={workDir} />
      </div>
      <div className={`absolute inset-0 ${isCreate ? '' : 'hidden'}`}>
        <CreatePage workDir={workDir} />
      </div>
      <div className={`absolute inset-0 ${isTerminal ? '' : 'hidden'}`}>
        <TerminalPage workDir={workDir} />
      </div>
      <div className={`absolute inset-0 ${isProject ? '' : 'hidden'}`}>
        <ProjectDetailPage workDir={workDir} />
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <div className="h-screen flex flex-col bg-gray-50">
          <header className="bg-white border-b px-4 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-bold text-gray-800">POMASA</h1>
              <TabNav />
            </div>
            <div className="flex items-center gap-2">
              <RefreshControl />
              <WorkDirSelector />
              <LanguageSwitcher />
            </div>
          </header>
          <PageContainer />
        </div>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
