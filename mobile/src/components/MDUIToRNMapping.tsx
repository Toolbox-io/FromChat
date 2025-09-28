import React from 'react';
import { 
    View, 
    Text, 
    TouchableOpacity, 
    ScrollView,
    Image,
    ActivityIndicator
} from 'react-native';
import { 
    Button, 
    Card, 
    List, 
    Avatar, 
    Chip, 
    Switch, 
    TextInput, 
    Dialog, 
    Portal,
    ProgressBar,
    IconButton,
    FAB,
    Surface,
    Divider,
    Badge,
    Menu,
    Searchbar,
    SegmentedButtons,
    RadioButton,
    Checkbox
} from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

// MDUI to React Native Paper Component Mapping
export const MDUIComponents = {
    // Basic Components
    'mdui-button': Button,
    'mdui-button-icon': IconButton,
    'mdui-fab': FAB,
    'mdui-card': Card,
    'mdui-chip': Chip,
    'mdui-switch': Switch,
    'mdui-text-field': TextInput,
    'mdui-dialog': Dialog,
    'mdui-circular-progress': ActivityIndicator,
    'mdui-linear-progress': ProgressBar,
    'mdui-badge': Badge,
    'mdui-menu': Menu,
    'mdui-select': Menu,
    'mdui-menu-item': Menu.Item,
    
    // Layout Components
    'mdui-tabs': SegmentedButtons,
    'mdui-tab': Button,
    'mdui-tab-panel': View,
    'mdui-bottom-app-bar': Surface,
    'mdui-top-app-bar-title': Text,
    
    // List Components
    'mdui-list': List.Section,
    'mdui-list-item': List.Item,
    
    // Icon Components
    'mdui-icon': MaterialCommunityIcons,
    
    // Form Components
    'mdui-radio': RadioButton,
    'mdui-checkbox': Checkbox,
};

// Prop mapping functions
export const mapButtonProps = (props: any) => {
    const { variant, size, disabled, ...otherProps } = props;
    return {
        mode: variant === 'filled' ? 'contained' : variant === 'outlined' ? 'outlined' : 'text',
        disabled,
        ...otherProps
    };
};

export const mapIconButtonProps = (props: any) => {
    const { icon, size, disabled, ...otherProps } = props;
    return {
        icon,
        size: size || 24,
        disabled,
        ...otherProps
    };
};

export const mapTextFieldProps = (props: any) => {
    const { variant, label, placeholder, disabled, value, onInput, onChange, ...otherProps } = props;
    return {
        mode: variant === 'outlined' ? 'outlined' : 'flat',
        label,
        placeholder,
        disabled,
        value,
        onChangeText: (text: string) => {
            if (onInput) onInput({ target: { value: text } });
            if (onChange) onChange({ target: { value: text } });
        },
        ...otherProps
    };
};

export const mapDialogProps = (props: any) => {
    const { open, onOpenChange, children, ...otherProps } = props;
    return {
        visible: open,
        onDismiss: () => onOpenChange?.(false),
        children,
        ...otherProps
    };
};

export const mapChipProps = (props: any) => {
    const { variant, size, ...otherProps } = props;
    return {
        mode: variant === 'filled' ? 'flat' : 'outlined',
        ...otherProps
    };
};

export const mapListProps = (props: any) => {
    return props;
};

export const mapListItemProps = (props: any) => {
    const { title, description, leading, trailing, onPress, ...otherProps } = props;
    return {
        title,
        description,
        left: leading,
        right: trailing,
        onPress,
        ...otherProps
    };
};

export const mapTabsProps = (props: any) => {
    const { value, onValueChange, children, ...otherProps } = props;
    return {
        value,
        onValueChange,
        ...otherProps
    };
};

export const mapTabProps = (props: any) => {
    const { value, label, icon, ...otherProps } = props;
    return {
        value,
        label,
        icon,
        ...otherProps
    };
};

export const mapIconProps = (props: any) => {
    const { name, size = 24, color, ...otherProps } = props;
    return {
        name,
        size,
        color,
        ...otherProps
    };
};

export const mapSwitchProps = (props: any) => {
    const { checked, onCheckedChange, disabled, ...otherProps } = props;
    return {
        value: checked,
        onValueChange: onCheckedChange,
        disabled,
        ...otherProps
    };
};

export const mapProgressProps = (props: any) => {
    const { value, indeterminate, ...otherProps } = props;
    return {
        progress: value,
        indeterminate,
        ...otherProps
    };
};

export const mapBadgeProps = (props: any) => {
    const { children, ...otherProps } = props;
    return {
        children,
        ...otherProps
    };
};

export const mapMenuProps = (props: any) => {
    const { open, onOpenChange, anchor, children, ...otherProps } = props;
    return {
        visible: open,
        onDismiss: () => onOpenChange?.(false),
        anchor,
        children,
        ...otherProps
    };
};

export const mapMenuItemProps = (props: any) => {
    const { title, onPress, ...otherProps } = props;
    return {
        title,
        onPress,
        ...otherProps
    };
};

export const mapFABProps = (props: any) => {
    const { icon, size, variant, ...otherProps } = props;
    return {
        icon,
        size: size || 'medium',
        mode: variant === 'extended' ? 'flat' : 'elevated',
        ...otherProps
    };
};

export const mapCardProps = (props: any) => {
    const { children, ...otherProps } = props;
    return {
        children,
        ...otherProps
    };
};

export const mapSurfaceProps = (props: any) => {
    const { children, ...otherProps } = props;
    return {
        children,
        ...otherProps
    };
};

// Main component factory
export const createMDUIComponent = (componentName: string) => {
    const Component = MDUIComponents[componentName as keyof typeof MDUIComponents];
    
    if (!Component) {
        console.warn(`Component ${componentName} not found in mapping`);
        return View;
    }
    
    return React.forwardRef<any, any>((props, ref) => {
        let mappedProps = { ...props };
        
        // Apply specific prop mappings based on component type
        switch (componentName) {
            case 'mdui-button':
                mappedProps = mapButtonProps(props);
                break;
            case 'mdui-button-icon':
                mappedProps = mapIconButtonProps(props);
                break;
            case 'mdui-text-field':
                mappedProps = mapTextFieldProps(props);
                break;
            case 'mdui-dialog':
                mappedProps = mapDialogProps(props);
                break;
            case 'mdui-chip':
                mappedProps = mapChipProps(props);
                break;
            case 'mdui-list':
                mappedProps = mapListProps(props);
                break;
            case 'mdui-list-item':
                mappedProps = mapListItemProps(props);
                break;
            case 'mdui-tabs':
                mappedProps = mapTabsProps(props);
                break;
            case 'mdui-tab':
                mappedProps = mapTabProps(props);
                break;
            case 'mdui-icon':
                mappedProps = mapIconProps(props);
                break;
            case 'mdui-switch':
                mappedProps = mapSwitchProps(props);
                break;
            case 'mdui-circular-progress':
            case 'mdui-linear-progress':
                mappedProps = mapProgressProps(props);
                break;
            case 'mdui-badge':
                mappedProps = mapBadgeProps(props);
                break;
            case 'mdui-menu':
                mappedProps = mapMenuProps(props);
                break;
            case 'mdui-menu-item':
                mappedProps = mapMenuItemProps(props);
                break;
            case 'mdui-fab':
                mappedProps = mapFABProps(props);
                break;
            case 'mdui-card':
                mappedProps = mapCardProps(props);
                break;
            case 'mdui-bottom-app-bar':
            case 'mdui-top-app-bar-title':
                mappedProps = mapSurfaceProps(props);
                break;
        }
        
        return React.createElement(Component as any, { ...mappedProps, ref });
    });
};

// Export individual components for easy use
export const MduiButton = createMDUIComponent('mdui-button');
export const MduiButtonIcon = createMDUIComponent('mdui-button-icon');
export const MduiFab = createMDUIComponent('mdui-fab');
export const MduiCard = createMDUIComponent('mdui-card');
export const MduiChip = createMDUIComponent('mdui-chip');
export const MduiSwitch = createMDUIComponent('mdui-switch');
export const MduiTextField = createMDUIComponent('mdui-text-field');
export const MduiDialog = createMDUIComponent('mdui-dialog');
export const MduiCircularProgress = createMDUIComponent('mdui-circular-progress');
export const MduiLinearProgress = createMDUIComponent('mdui-linear-progress');
export const MduiBadge = createMDUIComponent('mdui-badge');
export const MduiMenu = createMDUIComponent('mdui-menu');
export const MduiMenuItem = createMDUIComponent('mdui-menu-item');
export const MduiTabs = createMDUIComponent('mdui-tabs');
export const MduiTab = createMDUIComponent('mdui-tab');
export const MduiTabPanel = createMDUIComponent('mdui-tab-panel');
export const MduiBottomAppBar = createMDUIComponent('mdui-bottom-app-bar');
export const MduiTopAppBarTitle = createMDUIComponent('mdui-top-app-bar-title');
export const MduiList = createMDUIComponent('mdui-list');
export const MduiListItem = createMDUIComponent('mdui-list-item');
export const MduiIcon = createMDUIComponent('mdui-icon');
