import { Link, useLocation } from 'react-router-dom';
import { AppShell } from '@/components/common/AppShell';

const NotFound = () => {
  const location = useLocation();
  return (
    <AppShell>
      <div className="mx-auto flex max-w-xl flex-col items-start gap-4 px-4 py-24 sm:px-6">
        <p className="o-eyebrow text-o-teal">404</p>
        <h1 className="text-3xl font-semibold text-o-text">This page does not exist</h1>
        <p className="text-o-text2">
          Nothing is at <code className="font-mono text-o-text">{location.pathname}</code>.
        </p>
        <Link to="/" className="o-button-primary">
          Return to Orpheus
        </Link>
      </div>
    </AppShell>
  );
};

export default NotFound;
