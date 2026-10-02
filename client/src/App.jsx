import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import RequireAuth from './components/RequireAuth';
import Overview from './pages/Overview';
import Branches from './pages/Branches';
import Territories from './pages/Territories';
import Login from './pages/Login';
import Setup from './pages/Setup';
import AcceptInvite from './pages/AcceptInvite';
import Members from './pages/Members';
import MemberDetail from './pages/MemberDetail';
import WelfareDashboard from './pages/WelfareDashboard';
import WelfareCaseDetail from './pages/WelfareCaseDetail';
import Events from './pages/Events';
import EventDetail from './pages/EventDetail';
import Departments from './pages/Departments';
import CreateDepartment from './pages/CreateDepartment';
import DepartmentDetail from './pages/DepartmentDetail';
import CheckIn from './pages/CheckIn';
import Admin from './pages/Admin';
import ComingSoon from './pages/ComingSoon';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/setup" element={<Setup />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Overview />} />
          <Route path="/branches" element={<Branches />} />
          <Route path="/territories" element={<Territories />} />
          <Route path="/members" element={<Members />} />
          <Route path="/members/:id" element={<MemberDetail />} />
          <Route path="/welfare" element={<WelfareDashboard />} />
          <Route path="/welfare/:id" element={<WelfareCaseDetail />} />
          <Route path="/events" element={<Events />} />
          <Route path="/events/:id" element={<EventDetail />} />
          <Route path="/departments" element={<Departments />} />
          <Route path="/departments/new" element={<CreateDepartment />} />
          <Route path="/departments/:id" element={<DepartmentDetail />} />
          <Route path="/checkin" element={<CheckIn />} />
          <Route path="/admin" element={<Admin />} />
          {/* Not built yet — placeholder instead of a blank page */}
          <Route path="/giving" element={<ComingSoon />} />
          <Route path="/pastoral-care" element={<ComingSoon />} />
          <Route path="*" element={<ComingSoon />} />
        </Route>
      </Route>
    </Routes>
  );
}
