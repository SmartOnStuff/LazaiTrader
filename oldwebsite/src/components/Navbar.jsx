import React, { useState } from 'react';
import { close, gmetis, menu } from '../assets';
import { navLinks } from '../constants';

const Navbar = () => {
  const [toggle, setToggle] = useState(false);

  const handleNavClick = (navId) => {
    setToggle(false); // Close mobile menu when clicking a nav item
    // Smooth scroll to section
    const element = document.getElementById(navId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <nav className='w-full flex py-6 justify-between items-center navbar'>
      <div className="flex items-center">
        <img src={gmetis} alt='LazaiTrader' className='w-[48px] h-[48px] object-contain mr-3'/>
        <span className='font-poppins font-bold text-[24px] text-white'>LazaiTrader</span>
      </div>
      
      {/* Desktop Menu */}
      <ul className='list-none sm:flex hidden justify-end items-center flex-1'>
        {navLinks.map((nav, i) => (
          <li 
            key={nav.id}
            className={`font-poppins font-normal cursor-pointer text-[16px] ${
              i === navLinks.length - 1 ? 'mr-0' : 'mr-10'
            } text-white hover:text-secondary transition-colors`}
          >
            <button onClick={() => handleNavClick(nav.id)}>
              {nav.title}
            </button>
          </li>        
        ))}
      </ul>
      
      {/* Mobile Menu Button */}
      <div className='sm:hidden flex flex-1 justify-end items-center'>
        <img
          src={toggle ? close : menu}
          alt='menu'
          className='w-[28px] h-[28px] object-contain cursor-pointer'
          onClick={() => setToggle((previous) => !previous)}
        />
        
        {/* Mobile Menu */}
        <div className={`${
          toggle ? 'flex' : 'hidden'
        } p-6 bg-black-gradient absolute top-20 right-0 mx-4 my-2 min-w-[140px] rounded-xl sidebar z-50`}>
          <ul className='list-none flex flex-col justify-end items-start flex-1 w-full'>
            {navLinks.map((nav, i) => (
              <li 
                key={nav.id}
                className={`font-poppins font-normal cursor-pointer text-[16px] ${
                  i === navLinks.length - 1 ? 'mb-0' : 'mb-4'
                } text-white hover:text-secondary transition-colors w-full`}
              >
                <button 
                  onClick={() => handleNavClick(nav.id)}
                  className="w-full text-left"
                >
                  {nav.title}
                </button>
              </li>        
            ))}
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;