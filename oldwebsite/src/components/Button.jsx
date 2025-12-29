import React from 'react'

const Button = ({ styles, text, link }) => {
  return (
    <a href={link} className={`py-4 px-6 bg-blue-gradient font-poppins font-medium text-[18px] text-primary outline-none ${styles} rounded-[10px]`}>
      {text}
    </a>
  )
}

export default Button
