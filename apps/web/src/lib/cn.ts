/**
 * Utilitario para mesclar classes Tailwind.
 * Usado pelos componentes shadcn para combinar variantes e classes customizadas.
 */
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
