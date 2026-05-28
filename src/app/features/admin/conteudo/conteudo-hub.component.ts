import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface HubCard {
  title: string;
  description: string;
  route: string;
  icon: string;
}

@Component({
  selector: 'app-conteudo-hub',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './conteudo-hub.component.html',
  styleUrl: './conteudo-hub.component.scss'
})
export class ConteudoHubComponent {
  cards: HubCard[] = [
    {
      title: 'Home',
      description: 'Edite títulos e subtítulos das seções e a frase do buscador.',
      route: 'home',
      icon: 'home'
    },
    {
      title: 'Cabeçalho',
      description: 'Edite os nomes, ordem e visibilidade dos links do menu principal.',
      route: 'cabecalho',
      icon: 'header'
    },
    {
      title: 'Rodapé',
      description: 'Edite a marca, a frase de apresentação e o copyright do rodapé.',
      route: 'rodape',
      icon: 'footer'
    },
    {
      title: 'Sobre',
      description: 'Conteúdo institucional exibido na home e na página Sobre.',
      route: 'sobre',
      icon: 'about'
    },
    {
      title: 'Contato',
      description: 'Telefone, e-mail, redes sociais e endereço usados no rodapé.',
      route: 'contato',
      icon: 'contact'
    },
    {
      title: 'Banners',
      description: 'Carrossel da home — adicione, reordene ou remova banners.',
      route: '/admin/banners',
      icon: 'banner'
    }
  ];
}
