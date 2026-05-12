import { CanDeactivateFn } from '@angular/router';
import { Observable } from 'rxjs';

/**
 * Interface implementada pelos componentes admin que possuem formulários.
 * Retorna `true` para liberar a saída, `false` para bloquear, ou um
 * Observable<boolean> quando precisa abrir um modal e aguardar a decisão
 * do usuário.
 */
export interface CanComponentDeactivate {
  canDeactivate: () => boolean | Observable<boolean> | Promise<boolean>;
}

export const unsavedChangesGuard: CanDeactivateFn<CanComponentDeactivate> = (component) => {
  return component?.canDeactivate ? component.canDeactivate() : true;
};
