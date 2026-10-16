import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const OrderPayment = () => {
    const navigate = useNavigate();

    useEffect(() => {
        navigate('/user/my-agri-orders', { replace: true });
    }, [navigate]);

    return null;
};

export default OrderPayment;
