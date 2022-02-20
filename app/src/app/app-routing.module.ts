import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: 'crosspoint',
    loadChildren: () =>
      import('./crosspoint/crosspoint.module').then((m) => m.CrosspointModule),
  },
  { path: '**', redirectTo: '/crosspoint', pathMatch: 'full' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
