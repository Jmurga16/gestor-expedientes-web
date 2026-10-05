import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LayoutComponent } from './layout.component';
import { HomeComponent } from '../../../shared/components/home/home.component';
import { AdminGuard } from '../../../auth/guards/admin.guard';

const routes: Routes = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      {
        path: 'manual',
        loadComponent: () => import('../../../shared/components/manual/manual.component').then(m => m.ManualComponent)
      },
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full',
      },
      {
        path: 'user',
        loadChildren: () =>
          import('../../../modules/user/user.module').then((m) => m.UserModule),
        canActivate: [AdminGuard]
      },
      {
        path: 'tipologia',
        loadChildren: () =>
          import('../../../modules/tipologia/tipologia.module').then((m) => m.TipologiaModule),
        canActivate: [AdminGuard]
      },
      {
        path: 'area',
        loadChildren: () =>
          import('../../../modules/area/area.module').then((m) => m.AreaModule),
        canActivate: [AdminGuard]
      },
      {
        path: 'workflow',
        loadChildren: () =>
          import('../../../modules/workflow/workflow.module').then((m) => m.WorkflowModule),
        canActivate: [AdminGuard]
      },
      {
        path: 'demanda',
        loadChildren: () =>
          import('../../../modules/demanda/demanda.module').then((m) => m.DemandaModule),
      },
      {
        path: 'home',
        component: HomeComponent
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class LayoutRoutingModule { }
