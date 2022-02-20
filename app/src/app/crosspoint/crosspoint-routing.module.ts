import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CrosspointComponent } from './crosspoint.component';

const routes: Routes = [{ path: '', component: CrosspointComponent }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CrosspointRoutingModule { }
