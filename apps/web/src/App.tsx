import { Navigate, Route, Routes } from "react-router-dom"

import { Toaster } from "@/components/ui/toaster"
import { LoginPage } from "@/features/auth"
import { CursosPage } from "@/features/cursos"
import { UsuariosPage } from "@/features/usuarios"
import { HomePage } from "@/pages/home/HomePage"
import { UsuarioDetail } from "@/pages/usuarios/UsuarioDetail"

/**
 * Rotas principais da aplicação web.
 */
export function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/cursos" element={<CursosPage />} />
        <Route path="/usuarios" element={<UsuariosPage />} />
        <Route path="/usuarios/:usuarioId" element={<UsuarioDetail />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      <Toaster />
    </>
  )
}
