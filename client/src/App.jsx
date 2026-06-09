import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import Settings from "./pages/Settings";
import { ThemeProvider } from "./contexts/ThemeContext";
import SmoothScroll from "./components/SmoothScroll";

const PrivateRoute = ({ children }) => {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          {/* Wrap SmoothScroll around your routes so it updates on page transitions */}
          {/* <SmoothScroll> */}
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route
                path="/"
                element={
                  <PrivateRoute>
                    <Home />
                  </PrivateRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <PrivateRoute>
                    <Settings />
                  </PrivateRoute>
                }
              />
            </Routes>
          {/* </SmoothScroll> */}
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;


