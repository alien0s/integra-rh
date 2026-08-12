import { Link, useNavigate } from "react-router-dom"
import {
  Bell,
  ChevronsUpDown,
  LogOut,
  Monitor,
  Moon,
  Settings,
  Sun,
  UserRound,
  UserShield,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { useTheme } from "@/components/theme-provider"
import { useUsuarioLogado } from "@/features/auth/hooks"
import { useAuth, usePersonificacao } from "@/features/auth/context"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

/**
 * Menu de usuário exibido no rodapé da sidebar. Usa a conta logada (JWT).
 */
export function NavUser() {
  const { isMobile } = useSidebar()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const { sair: encerrarSessao } = useAuth()
  const { ativo: personificando, atorOriginal, encerrar } = usePersonificacao()
  const { authUser, usuario: perfil } = useUsuarioLogado()

  if (!authUser) return null

  // authUser/perfil já refletem a identidade certa em qualquer caso: ao
  // personificar, o próprio token JWT passa a ser o do usuário personificado.
  const usuario = {
    id: authUser.id,
    nome: perfil?.nome ?? authUser.nome,
    email: perfil?.email ?? authUser.email,
    iniciais: perfil?.iniciais ?? authUser.iniciais,
  }
  const avatarUrl = perfil?.fotoUrl || authUser.avatar || undefined

  function sair() {
    encerrarSessao()
    navigate("/login", { replace: true })
  }

  async function voltarAoMeuPerfil() {
    const meuId = atorOriginal?.id
    try {
      await encerrar()
      navigate(meuId ? `/usuarios/${meuId}` : "/home")
    } catch {
      // Erro (ex.: falha de rede) fica disponível em usePersonificacao().erro.
    }
  }

  return (
    <>
      {/* Aviso de personificação: bloco âmbar com ação de voltar ao perfil logado. */}
      {personificando && (
        <div className="mb-2 flex items-center gap-2 rounded-md bg-yellow-400 px-2.5 py-2 text-yellow-950 group-data-[collapsible=icon]/sidebar:hidden">
          <UserShield className="h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-xs font-medium">Personificando</p>
            <p className="truncate text-[11px] text-yellow-900">
              {usuario.nome}
            </p>
          </div>
          <button
            type="button"
            onClick={voltarAoMeuPerfil}
            className="shrink-0 rounded bg-yellow-950/10 px-2 py-1 text-xs font-medium transition-colors hover:bg-yellow-950/20"
          >
            Voltar
          </button>
        </div>
      )}

      <SidebarMenu>
        <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar
                className={cn(
                  "h-8 w-8 rounded-lg group-data-[collapsible=icon]/sidebar:rounded-md",
                  personificando &&
                    "ring-2 ring-yellow-400 ring-offset-2 ring-offset-sidebar",
                )}
              >
                <AvatarImage src={avatarUrl} alt={usuario.nome} />
                <AvatarFallback className="rounded-lg">
                  {usuario.iniciais}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]/sidebar:hidden">
                <span className="truncate font-medium">{usuario.nome}</span>
                <span className="truncate text-xs">{usuario.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4 group-data-[collapsible=icon]/sidebar:hidden" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={avatarUrl} alt={usuario.nome} />
                  <AvatarFallback className="rounded-lg">
                    {usuario.iniciais}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{usuario.nome}</span>
                  <span className="truncate text-xs">{usuario.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Tema
            </DropdownMenuLabel>

            <div className="px-2 pb-2 pt-1">
              <Tabs
                value={theme}
                onValueChange={(val) => setTheme(val as "system" | "light" | "dark")}
              >
                <TabsList className="grid w-full grid-cols-3 h-8">
                  <TabsTrigger value="system" className="flex items-center gap-2 h-6 px-2 text-xs">
                    <Monitor className="h-3.5 w-3.5" />
                    <span className="truncate">Sistema</span>
                  </TabsTrigger>
                  <TabsTrigger value="light" className="flex items-center gap-2 h-6 px-2 text-xs">
                    <Sun className="h-3.5 w-3.5" />
                    <span className="truncate">Dia</span>
                  </TabsTrigger>
                  <TabsTrigger value="dark" className="flex items-center gap-2 h-6 px-2 text-xs">
                    <Moon className="h-3.5 w-3.5" />
                    <span className="truncate">Noite</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link to={`/usuarios/${usuario.id}`}>
                  <UserRound />
                  Meu perfil
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/configuracoes">
                  <Settings />
                  Configurações
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Bell />
                Notificações
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={sair}
              className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
            >
              <LogOut />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </>
  )
}
