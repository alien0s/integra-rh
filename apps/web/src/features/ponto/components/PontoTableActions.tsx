import { Search } from 'lucide-react'

import { Input } from '@/components/ui/input'

interface PontoTableActionsProps {
  search: string
  onSearchChange: (value: string) => void
}

/**
 * Ações acima da tabela de ponto — por enquanto, o campo de pesquisa
 * (filtra por funcionário), no mesmo estilo da tabela de usuários.
 */
export function PontoTableActions({
  search,
  onSearchChange,
}: PontoTableActionsProps) {
  return (
    <div className="flex items-center px-1 py-2">
      <div className="relative w-full sm:w-56">
        <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Pesquisar funcionário"
          className="h-8 bg-background pl-8 shadow-none"
        />
      </div>
    </div>
  )
}
