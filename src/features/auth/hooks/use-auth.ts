import { useContext } from 'react';
import { authContext } from '../context/auth-context';

export const useAuth = () => {
    const context = useContext(authContext);

    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider.');
    }

    return context;
};
