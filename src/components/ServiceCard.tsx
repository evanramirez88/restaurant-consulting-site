import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

interface ServiceCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  link?: string;
}

const ServiceCard: React.FC<ServiceCardProps> = ({ icon: Icon, title, description, link = '/services' }) => (
  <div className="bg-slate p-8 rounded-xl border border-line card-hover-lift group card-premium stagger-child">
    <div className="w-14 h-14 bg-ink rounded-lg flex items-center justify-center mb-6 group-hover:bg-brass transition-colors border border-line">
      <Icon className="text-mint w-7 h-7 group-hover:text-ink transition-colors" />
    </div>
    <h3 className="font-serif text-xl font-bold text-cream mb-3">{title}</h3>
    <p className="text-mist leading-relaxed text-sm mb-4">{description}</p>
    <Link to={link} className="text-brass font-semibold text-sm hover:text-mint transition-colors inline-flex items-center brass-line">
      Learn More <ArrowRight className="w-3 h-3 ml-1" />
    </Link>
  </div>
);

export default ServiceCard;
