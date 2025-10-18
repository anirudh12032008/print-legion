import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  createBrowserRouter,
  RouterProvider,
} from "react-router";
import './index.css'

import PrintersPage from './pages/PrintersPage.jsx';
import Landing from './pages/Landing.jsx';
import RequestPrint from './pages/RequestPrint.jsx';
import Requests from './pages/Requests.jsx';

// actual routing
const router = createBrowserRouter([
  {
    path: "/",
    element: <Landing />,
  },
  {
    path: "/printers",
    element: <PrintersPage />,
  },
  {
    path: "/request",
    element: <RequestPrint />,
  },
  {
    path: "/requests",
    element: <Requests />,
  },
  {
    path: "/test",
    element: <div>TEST ROUTE</div>
  }
]);

// dom setup
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)