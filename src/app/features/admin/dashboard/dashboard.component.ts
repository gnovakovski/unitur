import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  stats = [
    { label: 'Posts', value: 0, color: '#3a75c3' },
    { label: 'Viagens', value: 0, color: '#ff812c' },
    { label: 'Depoimentos', value: 0, color: '#28a745' },
    { label: 'Categorias', value: 0, color: '#6f42c1' }
  ];

  recentPosts: any[] = [];
  recentTrips: any[] = [];

  ngOnInit() {
    // TODO: Carregar dados reais da API
    this.loadStats();
  }

  loadStats() {
    // Simulação - substituir por chamada real à API
    this.stats = [
      { label: 'Posts', value: 24, color: '#3a75c3' },
      { label: 'Viagens', value: 12, color: '#ff812c' },
      { label: 'Depoimentos', value: 48, color: '#28a745' },
      { label: 'Categorias', value: 8, color: '#6f42c1' }
    ];
  }
}
