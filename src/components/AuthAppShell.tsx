import { Outlet } from "react-router-dom";
import { AuthProvider } from "./AuthProvider";

export default function AuthAppShell() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}