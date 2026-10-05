export const ESTADO_FINALIZADO = 7;
export const ESTADOS_TERMINALES = [4, 5, ESTADO_FINALIZADO];

export const COLORES_ESTADO: Record<number, { fondo: string; borde: string; nombre: string }> = {
  1: { fondo: '#dbeafe', borde: '#1d4ed8', nombre: 'Receptada' },
  2: { fondo: '#fef3c7', borde: '#b45309', nombre: 'Suspendido' },
  3: { fondo: '#e0e7ff', borde: '#4338ca', nombre: 'En tratamiento' },
  4: { fondo: '#dcfce7', borde: '#15803d', nombre: 'Cerrado y Resuelto' },
  5: { fondo: '#fee2e2', borde: '#b91c1c', nombre: 'Cerrado sin Resolución' },
  6: { fondo: '#ffedd5', borde: '#c2410c', nombre: 'Pendiente' },
  7: { fondo: '#ccfbf1', borde: '#0f766e', nombre: 'Finalizado' },
};
