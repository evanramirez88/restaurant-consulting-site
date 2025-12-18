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
  <div className="bg-white p-8 rounded-xl border border-gray-200 border-l-4 border-l-amber-500 card-hover-lift group stagger-child">
    <div className="w-14 h-14 bg-primary-dark rounded-full flex items-center justify-center mb-6 group-hover:bg-orange-600 transition-colors">
      <Icon className="text-white w-7 h-7 transition-colors" />
    </div>
    <h3 className="font-display text-xl font-bold text-gray-900 mb-3">{title}</h3>
    <p className="text-gray-600 leading-relaxed text-sm mb-4">{description}</p>
    <Link to={link} className="text-amber-500 font-semibold text-sm hover:text-orange-600 transition-colors inline-flex items-center brass-line">
      Learn More <ArrowRight className="w-3 h-3 ml-1" />
    </Link>
  </div>
);

export default ServiceCard;
