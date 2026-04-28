import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss'
})
export class AboutComponent implements OnInit, AfterViewInit, OnDestroy {
  private observer!: IntersectionObserver;

  stats = [
    { number: '29+', label: 'Anos de Experiência' },
    { number: '1995', label: 'Fundação' },
    { number: '100%', label: 'Dedicação' },
    { number: 'EdC', label: 'Economia de Comunhão' }
  ];

  values = [
    {
      icon: '👨‍👩‍👧‍👦',
      title: 'Somos uma Família',
      description: 'Acima de tudo, valorizamos as relações humanas e tratamos cada cliente como parte da nossa família.'
    },
    {
      icon: '🌍',
      title: 'Bem Comum',
      description: 'Promovemos o bem comum e a união entre os povos através de nossas viagens e serviços.'
    },
    {
      icon: '🤝',
      title: 'Economia de Comunhão',
      description: 'Realizamos as práticas da EdC, compartilhando recursos e promovendo justiça social.'
    },
    {
      icon: '✝️',
      title: 'Espírito Fraterno',
      description: 'Servimos com espírito fraterno e profissional, buscando sempre o melhor para nossos clientes.'
    }
  ];

  timeline = [
    { year: '1995', event: 'Fundação da UNITUR', description: 'Sucedeu as atividades da RAPTIM no extremo sul do Brasil, especializada em passagens para missionários' },
    { year: '2000', event: 'Expansão de Serviços', description: 'Ampliação do atendimento para diversos tipos de público: lazer, negócios e fé' },
    { year: '2010', event: 'Movimento dos Focolares', description: 'Fortalecimento do vínculo com o Movimento dos Focolares e práticas da EdC' },
    { year: '2015', event: 'Alcance Nacional', description: 'Organização de grupos de peregrinação com origem em qualquer região do Brasil' },
    { year: '2024', event: 'Transformação Digital', description: 'Website moderno como ferramenta importante no relacionamento com clientes' }
  ];

  constructor(private elementRef: ElementRef) {}

  ngOnInit() {}

  ngAfterViewInit() {
    this.setupScrollAnimations();
  }

  ngOnDestroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  private setupScrollAnimations() {
    const options = {
      root: null,
      rootMargin: '0px',
      threshold: 0.15
    };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
        }
      });
    }, options);

    // Observar todos os elementos com classe scroll-animate
    const elements = this.elementRef.nativeElement.querySelectorAll('.scroll-animate');
    elements.forEach((el: Element) => {
      this.observer.observe(el);
    });
  }
}
