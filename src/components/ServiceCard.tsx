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
  <div className="bg-slate-50 p-8 rounded-xl border border-slate-100 hover:shadow-xl hover:border-brand-accent/30 transition-all duration-300 group">
    <div className="w-14 h-14 bg-brand-dark rounded-lg flex items-center justify-center mb-6 group-hover:bg-brand-accent transition-colors">
      <Icon className="text-white w-7 h-7" />
    </div>
    <h3 className="font-serif text-xl font-bold text-brand-dark mb-3">{title}</h3>
    <p className="text-slate-600 leading-relaxed text-sm mb-4">{description}</p>
    <Link to={link} className="text-brand-accent font-semibold text-sm hover:underline inline-flex items-center">
      Learn More <ArrowRight className="w-3 h-3 ml-1" />
    </Link>
  </div>
);

export default ServiceCard;