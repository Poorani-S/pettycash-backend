import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Pages
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import FundTransfer from "./pages/FundTransfer";
import NewTransaction from "./pages/NewTransaction";
import Transactions from "./pages/Transactions";
import Reports from "./pages/Reports";
import UserManagement from "./pages/UserManagement";

function App() {
  return (
    <Router>
      <div className="App">
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
        />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/fund-transfer" element={<FundTransfer />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/transactions/new" element={<NewTransaction />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/users" element={<UserManagement />} />
          <Route path="/" element={<Login />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
